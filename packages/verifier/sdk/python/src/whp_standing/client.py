"""Durable, explicit owner-policy purchase flow. No automatic wallet retry."""
import base64
import json
import os
import time
import urllib.request
import urllib.error
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlsplit
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from eth_account import Account
from eth_account.messages import encode_typed_data
from .core import need, canonical, strict_json, digest, quote_binding, client_proof, exact

USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
PAYEE = '0x1050eddd8282623b0c263ed6bdbd42370bbc28d3'


class FileJournal:
    """Caller-owned, private durable journal. Never commit this directory."""
    def __init__(self, directory):
        need(not Path(directory).is_symlink(), 'JOURNAL_SYMLINK')
        self.directory = Path(directory).resolve(); self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    @contextmanager
    def locked(self):
        lock = self.directory/'lock'
        fd = os.open(lock, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
        try: yield
        finally: os.close(fd); lock.unlink()
    def load(self):
        p = self.directory/'ledger.json'
        need(not p.is_symlink(), 'JOURNAL_SYMLINK')
        return strict_json(p.read_bytes()) if p.exists() else {'reserved':'0','purchases':{}}
    def save(self, state):
        p = self.directory/'ledger.tmp'
        fd = os.open(p, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
        try:
            with os.fdopen(fd,'wb') as f: f.write(canonical(state).encode()); f.flush(); os.fsync(f.fileno())
            os.replace(p,self.directory/'ledger.json')
            fd = os.open(self.directory, os.O_RDONLY); os.fsync(fd); os.close(fd)
        finally:
            if p.exists(): p.unlink()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('REDIRECT_REFUSED')


def transport(url, method, headers, body):
    req = urllib.request.Request(url, method=method, headers=headers, data=body if method!='GET' else None)
    try: response = urllib.request.build_opener(NoRedirect).open(req, timeout=30)
    except urllib.error.HTTPError as e: response = e
    with response:
        raw = response.read(2_000_001); need(len(raw)<=2_000_000,'RESPONSE_TOO_LARGE')
        return response.status, dict(response.headers), raw


def payment_terms(requirements, policy):
    exact(requirements, ['scheme','network','asset','payTo','amount','maxTimeoutSeconds','extra'])
    need(requirements['scheme']=='exact' and requirements['network']=='eip155:8453' and requirements['asset'].lower()==USDC and requirements['payTo'].lower()==PAYEE, 'PAYMENT_DESTINATION')
    need(policy['network']==requirements['network'] and policy['asset'].lower()==USDC and policy['pay_to'].lower()==PAYEE, 'OWNER_POLICY_MISMATCH')
    need(requirements.get('extra')=={'assetTransferMethod':'eip3009','name':'USD Coin','paymentFlow':'authorization','version':'2'}, 'PAYMENT_SCHEME')
    need(str(requirements['amount']).isdigit() and int(requirements['amount'])==1000000 and int(requirements['amount'])<=int(policy['max_per_purchase']), 'PAYMENT_LIMIT')
    need(type(requirements['maxTimeoutSeconds']) is int and 0<requirements['maxTimeoutSeconds']<=300, 'PAYMENT_TIMEOUT')


def typed_payment(q, address, at):
    r = q['payment_requirements']; nonce = '0x'+digest({'domain':'WHP-STANDING-PURCHASE-BINDING-v1','quote':q})
    authorization = {'from':address,'to':r['payTo'],'value':r['amount'],'validAfter':str(max(0,at-10)),'validBefore':str(min(q['expires_at'],at+r['maxTimeoutSeconds'])),'nonce':nonce}
    typed = {'domain':{'name':'USD Coin','version':'2','chainId':8453,'verifyingContract':r['asset']},'primaryType':'TransferWithAuthorization','types':{'EIP712Domain':[{'name':'name','type':'string'},{'name':'version','type':'string'},{'name':'chainId','type':'uint256'},{'name':'verifyingContract','type':'address'}], 'TransferWithAuthorization':[{'name':'from','type':'address'},{'name':'to','type':'address'},{'name':'value','type':'uint256'},{'name':'validAfter','type':'uint256'},{'name':'validBefore','type':'uint256'},{'name':'nonce','type':'bytes32'}]},'message':{**authorization,'value':int(authorization['value']),'validAfter':int(authorization['validAfter']),'validBefore':int(authorization['validBefore'])}}
    return authorization, typed


class StandingClient:
    def __init__(self, *, root_pin, buyer_key, origin, journal, request=transport, clock=lambda:int(time.time())):
        u = urlsplit(origin)
        need(u.scheme=='https' and u.hostname and not u.username and not u.password and not u.query and not u.fragment and u.path in ('','/'), 'HTTPS_ORIGIN_REQUIRED')
        need(len(root_pin)==64 and all(c in '0123456789abcdef' for c in root_pin), 'ADMITTED_ROOT_REQUIRED')
        need(isinstance(buyer_key, Ed25519PrivateKey), 'BUYER_KEY_REQUIRED')
        self.origin = origin.rstrip('/'); self.pin=root_pin; self.key=buyer_key; self.journal=journal; self.request=request; self.clock=clock
        self.public_key=base64.b64encode(buyer_key.public_key().public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)).decode()
    def _call(self, method, path, body=b'', payment=None, authenticated=True):
        need(path.startswith('/') and not path.startswith('//'), 'PATH_INVALID')
        h={'accept':'application/json','content-type':'application/json'}
        if authenticated: h['whp-client-proof']=client_proof(self.key,method,path,body,self.clock())
        if payment is not None: h['PAYMENT-SIGNATURE']=payment
        status,headers,raw=self.request(self.origin+path,method,h,body)
        return {'status':status,'headers':headers,'raw':raw,'body':strict_json(raw) if raw else None,'verified':False}
    def discover(self): return self._call('GET','/v1/contract',authenticated=False)
    def quote(self, submission_raw, trust_bundle):
        raw=submission_raw.encode() if isinstance(submission_raw,str) else submission_raw
        s=strict_json(raw); need(s['buyer_key']==self.public_key,'BUYER_KEY_MISMATCH'); need(len(raw)<=262144,'SUBMISSION_TOO_LARGE')
        pid=digest({'domain':'WHP-STANDING-PURCHASE-v1','root_pin':self.pin,'buyer_key':s['buyer_key'],'client_reference':s['client_reference']})
        with self.journal.locked(): need(pid not in self.journal.load()['purchases'],'PURCHASE_ALREADY_RESERVED')
        response=self._call('POST','/v1/evaluations',raw); need(response['status']==402,'QUOTE_CHALLENGE_REQUIRED')
        header=next((v for k,v in response['headers'].items() if k.lower()=='payment-required'),None)
        need(header is not None,'PAYMENT_REQUIRED_HEADER')
        challenge=strict_json(base64.b64decode(header,validate=True)); need(challenge['x402Version']==2,'X402_VERSION')
        envelope=challenge['extensions']['whp-standing']['info']['quote']
        q=quote_binding(envelope,trust_bundle,self.pin,raw,self.origin,self.clock())
        need(challenge['accepts']==[q['payment_requirements']] and challenge['resource']==q['resource'],'CHALLENGE_BINDING')
        return {'quote':envelope,'trust_bundle':trust_bundle,'submission_raw':base64.b64encode(raw).decode(),'purchase_id':pid,'origin':self.origin}
    def authorize(self, prepared, *, policy, address, sign_typed_data):
        need(prepared['origin']==self.origin,'ORIGIN_MISMATCH')
        raw=base64.b64decode(prepared['submission_raw'],validate=True)
        q=quote_binding(prepared['quote'],prepared['trust_bundle'],self.pin,raw,self.origin,self.clock()); r=q['payment_requirements']; payment_terms(r,policy)
        s=strict_json(raw); need(s['buyer_key']==self.public_key and prepared['purchase_id']==q['purchase_id'],'BUYER_BINDING')
        pid=q['purchase_id']; amount=int(r['amount']); need(type(policy['max_total']) is int or isinstance(policy['max_total'],str),'AGGREGATE_POLICY_REQUIRED')
        with self.journal.locked():
            state=self.journal.load(); need(pid not in state['purchases'],'ALREADY_AUTHORIZED_OR_AMBIGUOUS')
            need(int(state['reserved'])+amount<=int(policy['max_total']),'AGGREGATE_LIMIT')
            authorization,typed=typed_payment(q,address,self.clock())
            entry={**prepared,'state':'SIGNING_RESERVED','payment':None,'authorization':authorization,'root_pin':self.pin,'buyer_key':self.public_key}
            state['purchases'][pid]=entry; state['reserved']=str(int(state['reserved'])+amount); self.journal.save(state)
            # Fail or crash leaves a reservation. Never silently ask the wallet to sign again.
            signature=sign_typed_data(typed)
            recovered=Account.recover_message(encode_typed_data(full_message=typed),signature=signature)
            need(recovered.lower()==address.lower(),'WALLET_SIGNATURE_MISMATCH')
            payment={'x402Version':2,'accepted':r,'resource':q['resource'],'payload':{'authorization':authorization,'signature':signature}}
            entry['payment']=base64.b64encode(canonical(payment).encode()).decode(); entry['state']='AUTHORIZED'; self.journal.save(state)
        return pid
    def submit(self,purchase_id):
        entry=self._entry(purchase_id); need(entry['payment'] is not None,'AUTHORIZATION_AMBIGUOUS')
        with self.journal.locked():
            state=self.journal.load(); need(state['purchases'][purchase_id]['state']=='AUTHORIZED','REPLAY_REQUIRES_EXPLICIT_METHOD')
            state['purchases'][purchase_id]['state']='SUBMITTED_OR_UNCERTAIN'; self.journal.save(state)
        return self._call('POST','/v1/evaluations',base64.b64decode(entry['submission_raw']),entry['payment'])
    def replay_original(self,purchase_id):
        entry=self._entry(purchase_id); need(entry['payment'] is not None,'AUTHORIZATION_AMBIGUOUS')
        return self._call('POST','/v1/evaluations',base64.b64decode(entry['submission_raw']),entry['payment'])
    def _entry(self,pid):
        need(len(pid)==64 and all(c in '0123456789abcdef' for c in pid),'PURCHASE_ID')
        entry=self.journal.load()['purchases'].get(pid); need(entry is not None,'PURCHASE_NOT_IN_JOURNAL')
        need(entry['root_pin']==self.pin and entry['buyer_key']==self.public_key and entry['origin']==self.origin,'JOURNAL_BINDING')
        q=quote_binding(entry['quote'],entry['trust_bundle'],self.pin,base64.b64decode(entry['submission_raw']),self.origin,entry['quote']['payload']['issued_at'])
        need(q['purchase_id']==pid,'JOURNAL_PURCHASE_BINDING')
        if entry['payment']:
            payment=strict_json(base64.b64decode(entry['payment'])); a=payment['payload']['authorization']; r=q['payment_requirements']
            need(payment['accepted']==r and payment['resource']==q['resource'] and payment['x402Version']==2 and a==entry['authorization'],'JOURNAL_PAYMENT_BINDING')
            need(a['nonce']=='0x'+digest({'domain':'WHP-STANDING-PURCHASE-BINDING-v1','quote':q}) and a['to'].lower()==r['payTo'].lower() and a['value']==r['amount'],'JOURNAL_NONCE_BINDING')
            _,typed=typed_payment(q,a['from'],int(a['validAfter'])+10)
            typed['message'].update({'validAfter':int(a['validAfter']),'validBefore':int(a['validBefore'])})
            need(Account.recover_message(encode_typed_data(full_message=typed),signature=payment['payload']['signature']).lower()==a['from'].lower(),'JOURNAL_SIGNATURE_BINDING')
        return entry
    def recover(self,purchase_id):
        self._entry(purchase_id)
        return self._call('POST','/v1/purchases/'+purchase_id+'/recover')
    def result(self,purchase_id):
        self._entry(purchase_id)
        return self._call('GET','/v1/purchases/'+purchase_id+'/result')
