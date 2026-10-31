import test from "node:test";
import assert from "node:assert/strict";
import { cloudData, saveRecoveryData } from "../src/lib/sync.js";

test("sync excludes local metadata, local posts and queued support messages",()=>{
  assert.deepEqual(cloudData({name:"Name",_revision:1,_pendingSync:true,posts:[1],outbox:[2]}),{name:"Name"});
});
test("a save sends the expected revision and propagates server conflicts",async()=>{
  const error={code:"40001",message:"conflict"};let parameters;
  const client={rpc:async(name,args)=>{assert.equal(name,"save_recovery_data");parameters=args;return {error};}};
  await assert.rejects(saveRecoveryData(client,"owner",{userId:"owner",name:"Test",_revision:5}),value=>value===error);
  assert.equal(parameters.expected_revision,5);
});
test("a mismatched account cannot be saved",async()=>{
  await assert.rejects(saveRecoveryData({rpc(){throw Error("should not call");}},"other",{userId:"owner"}),/Account changed/);
});

test("a save without a valid server revision is not reported as successful",async()=>{
  await assert.rejects(saveRecoveryData({rpc:async()=>({data:null})},"owner",{userId:"owner"}),/did not confirm/);
});
