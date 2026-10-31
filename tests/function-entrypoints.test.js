import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { createChatHandler } from "../supabase/functions/chat/handler.ts";
import { createDeleteHandler } from "../supabase/functions/delete-account/handler.ts";

function entry(path, imports, extra={}) {
  let handler;
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  const output=transformSync(source,{loader:"ts",format:"cjs"}).code;
  vm.runInNewContext(output,{module:{exports:{}},require:name=>imports[name],Deno:{env:{get:name=>({SUPABASE_URL:"https://example.test",SUPABASE_ANON_KEY:"test-public-key",SUPABASE_SERVICE_ROLE_KEY:"test-service-key",GEMINI_API_KEY:"test-provider-key"})[name]},serve(value){handler=value;}},AbortSignal,Response,Request,console,...extra});
  return handler;
}
const request=()=>new Request("https://example.test/",{method:"POST",headers:{Authorization:"Bearer verified-token"},body:JSON.stringify({message:"Synthetic private message",country:"GB",user_id:"not-the-owner"})});

test("deployed chat entrypoint authenticates, checks quota and sends only a bounded POST to Gemini",async()=>{
  const calls=[];
  const handler=entry("../supabase/functions/chat/index.ts",{"./handler.ts":{createChatHandler}},{fetch:async(url,options)=>{
    calls.push({url,options});
    const body=url.endsWith("/auth/v1/user")?{id:"owner"}:url.includes("consume_chat_request")?true:{candidates:[{content:{parts:[{text:"Synthetic reply"}]}}]};
    return new Response(JSON.stringify(body));
  }});
  const response=await handler(request());assert.equal(response.status,200);assert.equal(calls.length,3);
  const generated=calls[2];assert.equal(generated.options.method,"POST");assert(generated.options.signal);assert.equal(generated.options.headers["x-goog-api-key"],"test-provider-key");
  assert(!generated.url.includes("Synthetic"));assert(!generated.url.includes("key="));assert(generated.options.body.includes("country code is GB"));
});

function deletionClient(failStorage=false){
  const calls=[],visited=new Set();
  const admin={auth:{getUser:async()=>({data:{user:{id:"owner"}}}),admin:{signOut:async()=>{calls.push("revoke");return {};},deleteUser:async(id)=>{calls.push("delete-user:"+id);return {};}}},storage:{from:()=>({
    list:async prefix=>{
      if(failStorage)return {error:new Error("Synthetic storage failure")};
      if(visited.has(prefix))return {data:[]};visited.add(prefix);
      return {data:prefix==="owner"?[{id:"file",name:"avatar.png"},{id:null,name:"nested"}]:[{id:"file",name:"picture.jpg"}]};
    },remove:async paths=>{calls.push(...paths.map(path=>"file:"+path));return {};},
  })},from(table){return {delete:()=>({or:async()=>{calls.push("reports");return {};},in:async()=>{calls.push("snapshots");return {};}}),select:()=>({eq:()=>({order:()=>({range:async offset=>({data:offset===0?[{id:"post"}]:[]})})})})};}};
  return {admin,calls};
}
test("deletion entrypoint revokes sessions, removes nested files and snapshots, then deletes the verified account",async()=>{
  const {admin,calls}=deletionClient();
  const handler=entry("../supabase/functions/delete-account/index.ts",{"./handler.ts":{createDeleteHandler},"npm:@supabase/supabase-js@2.117.2":{createClient:()=>admin}});
  assert.equal((await handler(request())).status,200);assert.equal(calls[0],"revoke");assert(calls.includes("file:owner/avatar.png"));assert(calls.includes("file:owner/nested/picture.jpg"));assert(calls.includes("snapshots"));assert.equal(calls.at(-1),"delete-user:owner");
});
test("a storage cleanup failure cannot be reported as successful account deletion",async()=>{
  const {admin,calls}=deletionClient(true);
  const handler=entry("../supabase/functions/delete-account/index.ts",{"./handler.ts":{createDeleteHandler},"npm:@supabase/supabase-js@2.117.2":{createClient:()=>admin}});
  const response=await handler(request());assert.equal(response.status,503);assert(!calls.some(call=>call.startsWith("delete-user:")));
});
