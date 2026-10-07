import base64
import os
import tempfile
import unittest
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from eth_account import Account
from eth_account.messages import encode_typed_data
from whp_standing import StandingClient,FileJournal,verify_offline,canonical,strict_json,digest,seal,client_proof
from whp_standing.core import PROFILE,CONTRACT,VERIFIER,key_id,quote_binding,trust

AT=2000000000
ORIGIN='https://standing.test'
POLICY={'network':'eip155:8453','asset':'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913','pay_to':'0x1050eddd8282623b0c263ed6bdbd42370bbc28d3','max_per_purchase':'1000000','max_total':'1000000'}
def pub(k):return base64.b64encode(k.public_key().public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)).decode()
def fixture():
 root,issuer,buyer=[Ed25519PrivateKey.generate() for _ in range(3)];pin=key_id(pub(root))
 cert=seal({'public_key':pub(issuer),'subject':'Wheeler Hubbell Publishing','roles':['ISSUER'],'scopes':['scope'],'jurisdictions':['jurisdiction'],'operations':['INFORM'],'profile_hash':PROFILE,'valid_from':AT-100,'valid_until':AT+10000},'WHP-AUTHORITY-CERTIFICATE-v1',root)
 pa=seal({'profile_hash':PROFILE,'contract_hash':CONTRACT,'verifier_sha256':VERIFIER,'ratified':True,'issuer':'Wheeler Hubbell Publishing','environment':'LIVE','valid_from':AT-100,'valid_until':AT+10000},'WHP-PROFILE-AUTHORIZATION-v1',root)
 bundle={'root_public_key':pub(root),'profile_authorization':pa,'certificates':[cert],'revocations':[],'status_snapshot':seal({'sequence':0,'previous_hash':None,'profile_authorization_hash':digest(pa),'certificates_hash':digest([cert]),'revocations_hash':digest([]),'valid_from':AT-100,'valid_until':AT+10000},'WHP-TRUST-STATUS-v1',root)}
 s={'version':'WHP-STANDING-SUBMISSION-v1','client_reference':'synthetic','buyer_key':pub(buyer),'profile':{'id':'WHP-STANDING-STRUCTURED-PASSAGE','version':'1.0.0','sha256':PROFILE},'object':{'id':'synthetic','version':'1','root':'a'*64},'bounds':{'scope':'scope','jurisdiction':'jurisdiction','valid_from':AT-10,'valid_until':AT+100},'requested_operation':'INFORM','nodes':[],'transitions':[]}
 raw=canonical(s).encode();pid=digest({'domain':'WHP-STANDING-PURCHASE-v1','root_pin':pin,'buyer_key':s['buyer_key'],'client_reference':s['client_reference']})
 q={'purchase_id':pid,'request_hash':digest(s),'buyer_key':s['buyer_key'],'profile_hash':PROFILE,'issuer':'Wheeler Hubbell Publishing','environment':'LIVE','issued_at':AT,'expires_at':AT+300,'resource':{'url':ORIGIN+'/v1/evaluations','description':'One evaluation','mimeType':'application/json'},'payment_requirements':{'scheme':'exact','network':'eip155:8453','asset':POLICY['asset'],'payTo':POLICY['pay_to'],'amount':'1000000','maxTimeoutSeconds':300,'extra':{'assetTransferMethod':'eip3009','name':'USD Coin','paymentFlow':'authorization','version':'2'}},'charge_policy':'One evaluation regardless of outcome'}
 e=seal(q,'WHP-STANDING-QUOTE-v1',issuer);prepared={'quote':e,'trust_bundle':bundle,'submission_raw':base64.b64encode(raw).decode(),'purchase_id':pid,'origin':ORIGIN}
 return locals()

class ClientTests(unittest.TestCase):
 def test_strict_wire(self):
  for raw in ['{"a":1,"a":2}','1.0','-0','9007199254740992','"\\ud800"']:
   with self.assertRaises(ValueError):strict_json(raw)
  self.assertEqual(canonical({'😀':2,'a':1}),'{"a":1,"😀":2}')
 def test_proof(self):
  f=fixture();e=strict_json(base64.b64decode(client_proof(f['buyer'],'POST','/v1/evaluations',f['raw'],AT)))
  self.assertEqual(e['payload']['expires_at'],AT+120);self.assertEqual(e['payload']['body_hash'],digest(f['s']));self.assertEqual(len(e['payload']['nonce']),32)
 def test_root_and_quote(self):
  f=fixture();self.assertEqual(quote_binding(f['e'],f['bundle'],f['pin'],f['raw'],ORIGIN,AT)['purchase_id'],f['pid'])
  with self.assertRaises(ValueError):trust(f['bundle'],'0'*64,AT)
  with self.assertRaises(ValueError):quote_binding(f['e'],f['bundle'],f['pin'],f['raw'],ORIGIN,AT+301)
  f['e']['payload']['request_hash']='wrong'
  with self.assertRaises(Exception):quote_binding(f['e'],f['bundle'],f['pin'],f['raw'],ORIGIN,AT)
 def test_recovery_no_resign(self):
  f=fixture();wallet=Account.from_key('0x'+'11'*32);calls=[];signs=[]
  with tempfile.TemporaryDirectory() as td:
   journal=FileJournal(td)
   def request(url,method,headers,body):
    calls.append((url,method,headers,body))
    if url.endswith('/evaluations') and 'PAYMENT-SIGNATURE' not in headers:
     ch={'x402Version':2,'accepts':[f['q']['payment_requirements']],'resource':f['q']['resource'],'extensions':{'whp-standing':{'info':{'quote':f['e']}}}}
     return 402,{'payment-required':base64.b64encode(canonical(ch).encode()).decode()},b'{}'
    return 202,{},b'{"state":"PENDING"}'
   c=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=journal,request=request,clock=lambda:AT)
   p=c.quote(f['raw'],f['bundle'])
   def signer(typed):
    signs.append(typed);self.assertEqual(journal.load()['purchases'][f['pid']]['state'],'SIGNING_RESERVED');return '0x'+wallet.sign_message(encode_typed_data(full_message=typed)).signature.hex()
   pid=c.authorize(p,policy=POLICY,address=wallet.address,sign_typed_data=signer);c.submit(pid);c.recover(pid);c.result(pid);c.replay_original(pid)
   self.assertEqual(len(signs),1);paid=[x for x in calls if 'PAYMENT-SIGNATURE' in x[2]];self.assertEqual(len(paid),2);self.assertEqual(paid[0][2]['PAYMENT-SIGNATURE'],paid[1][2]['PAYMENT-SIGNATURE']);self.assertEqual(paid[0][3],f['raw'])
   for x in calls:
    if not x[0].endswith('/evaluations'):self.assertNotIn('PAYMENT-SIGNATURE',x[2])
   with self.assertRaises(ValueError):c.authorize(p,policy=POLICY,address=wallet.address,sign_typed_data=signer)
 def test_bad_terms_fail_before_signer(self):
  for field,value in [('amount','2000000'),('payTo','0x'+'00'*20),('asset','0x'+'00'*20),('network','eip155:1')]:
   f=fixture();f['q']['payment_requirements'][field]=value;f['prepared']['quote']=seal(f['q'],'WHP-STANDING-QUOTE-v1',f['issuer']);calls=[]
   with tempfile.TemporaryDirectory() as td:
    c=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=FileJournal(td),clock=lambda:AT)
    with self.assertRaises(ValueError):c.authorize(f['prepared'],policy=POLICY,address='0x'+'11'*20,sign_typed_data=lambda t:calls.append(t))
    self.assertEqual(calls,[])
 def test_failed_signer_is_not_retried(self):
  f=fixture();calls=[]
  def signer(t):calls.append(t);raise RuntimeError('lost wallet response')
  with tempfile.TemporaryDirectory() as td:
   c=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=FileJournal(td),clock=lambda:AT)
   with self.assertRaises(RuntimeError):c.authorize(f['prepared'],policy=POLICY,address='0x'+'11'*20,sign_typed_data=signer)
   with self.assertRaises(ValueError):c.authorize(f['prepared'],policy=POLICY,address='0x'+'11'*20,sign_typed_data=signer)
   self.assertEqual(len(calls),1)
 def test_historical_independent_verifier(self):
  root=Path(os.environ['WHP_PUBLIC_CHECKOUT']);runtime=os.environ['WHP_VERIFIER_RUNTIME'];raw=(root/'examples/genesis-selftest.mark.json').read_bytes();path=root/'bb8cb78205f1892dcbf00d845cf85e504a0efacf2a0d8a793313fa8c0e99b833.py';pin='c9507f2c5d0d80935a4885071c8372eeba25010e514e81401acabb246134bff6'
  r=verify_offline(raw,root_pin=pin,verifier_path=path,runtime_directory=runtime);self.assertEqual(r['report']['evaluation_replay'],'VERIFIED');self.assertEqual(r['report']['current_standing'],'NOT_CHECKED');self.assertFalse(r['report']['live_completion_verified'])
  with self.assertRaises(ValueError):verify_offline(raw,root_pin='0'*64,verifier_path=path,runtime_directory=runtime)
  with self.assertRaises(ValueError):verify_offline(raw,root_pin=pin,verifier_path=root/'verify_mark.py',runtime_directory=runtime)

if __name__=='__main__':unittest.main()

class AdditionalGates(unittest.TestCase):
 def test_aggregate_survives_restart(self):
  f=fixture();wallet=Account.from_key('0x'+'11'*32)
  def signer(t):return '0x'+wallet.sign_message(encode_typed_data(full_message=t)).signature.hex()
  with tempfile.TemporaryDirectory() as td:
   c=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=FileJournal(td),clock=lambda:AT);c.authorize(f['prepared'],policy=POLICY,address=wallet.address,sign_typed_data=signer)
   s={**f['s'],'client_reference':'second'};raw=canonical(s).encode();pid=digest({'domain':'WHP-STANDING-PURCHASE-v1','root_pin':f['pin'],'buyer_key':s['buyer_key'],'client_reference':s['client_reference']});q={**f['q'],'purchase_id':pid,'request_hash':digest(s)};prepared={**f['prepared'],'quote':seal(q,'WHP-STANDING-QUOTE-v1',f['issuer']),'submission_raw':base64.b64encode(raw).decode(),'purchase_id':pid};calls=[]
   restarted=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=FileJournal(td),clock=lambda:AT)
   with self.assertRaisesRegex(ValueError,'AGGREGATE_LIMIT'):restarted.authorize(prepared,policy=POLICY,address=wallet.address,sign_typed_data=lambda t:calls.append(t))
   self.assertEqual(calls,[])
 def test_corrupt_journal_refuses_transport(self):
  f=fixture();wallet=Account.from_key('0x'+'11'*32);calls=[]
  with tempfile.TemporaryDirectory() as td:
   j=FileJournal(td);c=StandingClient(root_pin=f['pin'],buyer_key=f['buyer'],origin=ORIGIN,journal=j,clock=lambda:AT,request=lambda *a:calls.append(a))
   c.authorize(f['prepared'],policy=POLICY,address=wallet.address,sign_typed_data=lambda t:'0x'+wallet.sign_message(encode_typed_data(full_message=t)).signature.hex())
   state=j.load();p=strict_json(base64.b64decode(state['purchases'][f['pid']]['payment']));p['payload']['authorization']['nonce']='0x'+'00'*32;state['purchases'][f['pid']]['payment']=base64.b64encode(canonical(p).encode()).decode();j.save(state)
   with self.assertRaises(ValueError):c.replay_original(f['pid'])
   self.assertEqual(calls,[])
