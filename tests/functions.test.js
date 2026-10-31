import test from "node:test";
import assert from "node:assert/strict";
import { createChatHandler } from "../supabase/functions/chat/handler.ts";
import { createDeleteHandler } from "../supabase/functions/delete-account/handler.ts";

const request=(body={},token="test-token")=>new Request("https://example.test/",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
test("AI rejects unauthenticated callers before quota or provider requests",async()=>{
  let called=false;
  const handler=createChatHandler({authenticate:async()=>null,consume:async()=>{called=true;return true;},generate:async()=>{called=true;return "reply";}});
  assert.equal((await handler(request({message:"hello"},null))).status,401);assert.equal(called,false);
});
test("AI rejects exhausted quota and oversized messages",async()=>{
  let called=false;
  const handler=createChatHandler({authenticate:async()=>"owner",consume:async()=>false,generate:async()=>{called=true;return "reply";}});
  assert.equal((await handler(request({message:"hello"}))).status,429);
  assert.equal((await handler(request({message:"x".repeat(4001)}))).status,400);assert.equal(called,false);
});
test("AI passes selected country and bounded history to only the configured provider",async()=>{
  let input;
  const handler=createChatHandler({authenticate:async()=>"owner",consume:async()=>true,generate:async(...args)=>{input=args;return "A reply";}});
  const response=await handler(request({message:"hello",country:"GB",history:Array.from({length:12},()=>({role:"system",text:"x".repeat(2100)}))}));
  assert.equal(response.status,200);assert.equal(input[0].length,11);assert.equal(input[0][0].parts[0].text.length,2000);assert.equal(input[0][0].role,"user");assert.equal(input[1],"GB");
});
test("provider failure returns an honest error instead of silently forwarding chats",async()=>{
  const handler=createChatHandler({authenticate:async()=>"owner",consume:async()=>true,generate:async()=>{throw Error("timeout");}});
  const response=await handler(request({message:"hello"}));assert.equal(response.status,503);assert.equal((await response.json()).reply,undefined);
});
test("account deletion always targets the verified caller, never a body-supplied user ID",async()=>{
  let removed;
  const handler=createDeleteHandler({authenticate:async()=>"verified-owner",removeData:async owner=>{removed=owner;}});
  const response=await handler(request({user_id:"someone-else"}));assert.equal(response.status,200);assert.equal(removed,"verified-owner");assert.equal((await response.json()).deleted,true);
});
test("failed or unauthenticated account deletion never reports success",async()=>{
  let called=false;
  const handler=createDeleteHandler({authenticate:async()=>"owner",removeData:async()=>{called=true;throw Error("storage failed");}});
  assert.equal((await handler(request({},null))).status,401);assert.equal(called,false);
  const response=await handler(request());assert.equal(response.status,503);assert.equal((await response.json()).deleted,undefined);
});
