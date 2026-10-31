import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { freshStore } from "../src/lib/store.js";

const compiled = await build({ entryPoints: [new URL("../src/main.jsx", import.meta.url).pathname], bundle: true, jsx: "automatic", format: "iife", write: false, loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, logLevel: "silent" });
const bundle = compiled.outputFiles[0].text;
const owner="11111111-1111-4111-8111-111111111111";
const user={ id:owner,email:"verify@example.test",aud:"authenticated",role:"authenticated",created_at:"2020-01-01T00:00:00Z",app_metadata:{provider:"email"},user_metadata:{full_name:"Verify User"} };
const exp=Math.floor(Date.now()/1000)+3600;
const token=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:owner,exp,aud:"authenticated",role:"authenticated"})).toString("base64url"),"synthetic-signature"].join(".");
const session={access_token:token,refresh_token:"synthetic-refresh",token_type:"bearer",expires_in:3600,expires_at:exp,user};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){ const end=Date.now()+8000;while(Date.now()<end){const value=check();if(value)return value;await sleep(20);}throw new Error("Timed out waiting for app state"); }
const completed=()=>({...freshStore(),name:"Verify User",done:1,start:Date.now()-86400000,userId:owner,email:user.email,spendMigrated:1,_revision:0,_pendingSync:false});

async function app(options, run){
  const dom=new JSDOM('<div id="root"></div>',{url:"http://localhost/",runScripts:"outside-only",pretendToBeVisual:true});
  const w=dom.window, calls=[], errors=[];
  let cloud=options.cloud??null,revision=options.revision||0,posts=options.posts||[];
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
  Object.assign(w,{Headers,Request,Response,TextEncoder,TextDecoder,AbortController,AbortSignal});
  const local=options.local;
  if(local)w.localStorage.setItem("steady",JSON.stringify(local));
  if(options.restored)w.localStorage.setItem("sb-atjidzxkzivzrxxbjprt-auth-token",JSON.stringify(session));
  w.fetch=async(input,init={})=>{
    const url=new URL(typeof input==="string"?input:input.url),method=(init.method||"GET").toUpperCase();
    const payload=init.body?JSON.parse(init.body):null;calls.push({url,method,payload,signal:init.signal});
    let body=[],status=200;
    if(url.hostname==="formsubmit.co"){
      if(options.deferSupport)return new Promise((resolve,reject)=>{options.resolveSupport=()=>resolve(new Response("{}"));init.signal?.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError")),{once:true});});
      status=options.supportFail?500:200;body={};
    } else if(url.pathname.includes("/auth/v1/token")||url.pathname.includes("/auth/v1/signup"))body=session;
    else if(url.pathname.includes("/auth/v1/logout"))return new Response(null,{status:204});
    else if(url.pathname.includes("/auth/v1/user"))body=user;
    else if(url.pathname.endsWith("/user_data"))body=cloud?[{data:cloud,revision}]:[];
    else if(url.pathname.endsWith("/rpc/save_recovery_data")){
      if(options.saveFail){status=503;body={code:"XX000",message:"Synthetic outage"};}
      else if(payload.expected_revision!==revision){status=409;body={code:"40001",message:"Saved progress changed"};}
      else{cloud=payload.payload;revision++;body=revision;}
    } else if(url.pathname.endsWith("/profiles"))body=method==="GET"?[{is_admin:false,status:options.suspended?"suspended":"active",warned_count:0}]:[];
    else if(url.pathname.endsWith("/community_posts")||url.pathname.endsWith("/posts")){
      if(method==="DELETE"){
        if(options.deleteFail){status=500;body={message:"Synthetic failed delete"};}
        else posts=posts.filter(post=>"eq."+post.id!==url.searchParams.get("id"));
      }else if(method==="POST")posts.push({...payload,id:"server-post",created_at:new Date().toISOString(),status:"active"});
      else if(method==="GET"){
        if(options.deferPosts)return new Promise(resolve=>{(options.postResolvers??=[]).push(()=>resolve(new Response(JSON.stringify(posts),{headers:{"Content-Type":"application/json"}})));});
        body=posts.filter(post=>url.pathname.endsWith("/community_posts")?post.visibility!=="private":post.user_id===owner);
      }
    } else if(url.pathname.endsWith("/functions/v1/delete-account")){
      status=options.deleteFail?503:200;body=options.deleteFail?{error:"failed"}:{deleted:true};
    }else if(url.pathname.endsWith("/functions/v1/chat"))body={reply:"Synthetic reply"};
    else throw Error("Unexpected request: "+url.pathname);
    return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
  };
  w.addEventListener("error",event=>errors.push(event.message));
  const text=()=>w.document.body.textContent;
  const click=async(label)=>{const button=await until(()=>{const matches=[...w.document.querySelectorAll("button")].filter(node=>node.textContent.trim()===label);return matches.find(node=>node.closest("dialog[open]"))||matches[0];});button.click();await sleep(30);};
  const fill=async(label,value)=>{
    const node=await until(()=>w.document.querySelector(`[aria-label="${label}"]`)||[...w.document.querySelectorAll("label")].find(node=>node.textContent.trim()===label)?.querySelector("input"));
    const proto=node.tagName==="SELECT"?w.HTMLSelectElement.prototype:node.tagName==="TEXTAREA"?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,"value").set.call(node,value);
    node.dispatchEvent(new w.Event(node.tagName==="SELECT"?"change":"input",{bubbles:true}));await sleep(20);
  };
  const api={w,calls,text,click,fill,stored:()=>JSON.parse(w.localStorage.getItem("steady")||"null"),home:()=>until(()=>/Good (morning|afternoon|evening),/.test(text())),onboarding:()=>until(()=>text().includes("Not sure gambling is a problem?"))};
  try{w.eval(bundle);await run(api);assert.deepEqual(errors,[]);}
  catch(error){error.message+="\nRendered app: "+text();throw error;}
  finally{w.close();}
}

test("new account preserves selected country and starts onboarding",()=>app({restored:true,local:{...freshStore(),country:"GB"}},async a=>{await a.onboarding();assert.equal(a.stored().country,"GB");}));
test("signup from a guest dashboard preserves recovery history",()=>app({local:{...freshStore(),name:"Guest Name",country:"GB",done:1,start:123,urges:[{t:1,before:5}],spendMigrated:1}},async a=>{
  await a.home();await a.click("Sign up");await a.fill("Email",user.email);await a.fill("Password","TestPassword1!");await a.click("Create account");
  await until(()=>a.stored()?.userId===owner);assert.equal(a.stored().country,"GB");assert.equal(a.stored().start,123);assert.equal(a.stored().urges.length,1);
}));
test("failed post deletion keeps the post and displays an error",()=>app({restored:true,cloud:completed(),deleteFail:true,posts:[{id:"cloud-post",user_id:owner,body:"My story",visibility:"community",display_name:"Verify User",created_at:new Date().toISOString(),status:"active"}]},async a=>{
  await a.home();await a.click("Community");await a.click("Delete");await a.click("Yes, delete");await until(()=>a.text().includes("Couldn't delete the post"));assert.equal(a.stored().posts.length,1);
}));
test("a feed response arriving after logout cannot restore private posts",async()=>{
  const options={restored:true,cloud:completed(),deferPosts:true,posts:[{id:"private-cloud",user_id:owner,body:"Private synthetic text",visibility:"private",created_at:new Date().toISOString()}]};
  await app(options,async a=>{
    await a.home();await until(()=>options.postResolvers?.length>=2);await a.click("Profile");await a.click("Sign out");await a.click("Sign out");
    await until(()=>a.text().includes("Welcome to Steady"));options.postResolvers.forEach(resolve=>resolve());await sleep(100);
    assert(!a.stored()?.posts?.length);assert(!a.text().includes("Private synthetic text"));
  });
});
test("failed account deletion does not clear local recovery data",()=>app({restored:true,cloud:completed(),deleteFail:true},async a=>{
  await a.home();await a.click("Profile");await a.click("Delete all my data");const ack=a.w.document.querySelector('input[type="checkbox"]');ack.click();await sleep(30);await a.click("Delete everything");
  await until(()=>a.text().includes("Deletion was not confirmed"));assert.equal(a.stored().userId,owner);assert.equal(a.stored().done,1);
}));
test("confirmed account deletion clears active data and account backup",()=>app({restored:true,cloud:completed()},async a=>{
  await a.home();await a.click("Profile");await a.click("Delete all my data");a.w.document.querySelector('input[type="checkbox"]').click();await sleep(30);await a.click("Delete everything");
  await until(()=>a.text().includes("Welcome to Steady"));assert.equal(a.stored(),null);assert.equal(a.w.localStorage.getItem("steady-account:"+owner),null);
}));
test("failed save remains pending and blocks destructive sign-out",()=>app({restored:true,cloud:completed(),saveFail:true},async a=>{
  await a.home();await a.click("Check in");await a.click("Save check-in");await until(()=>a.text().includes("haven't synced yet"));
  assert.equal(a.stored()._pendingSync,true);await a.click("Profile");await a.click("Sign out");await a.click("Sign out");await until(()=>a.text().includes("Save them before signing out"));assert.equal(a.stored().checks.length,1);
}));
test("older cloud data does not overwrite unsynced local edits",()=>app({restored:true,cloud:completed(),local:{...completed(),_pendingSync:true,checks:[{day:"2026-01-01",mood:5,urge:2,note:"Local note"}]}},async a=>{
  await a.home();assert.equal(a.stored().checks[0].note,"Local note");
}));
test("suspended users retain private recovery and local support",()=>app({restored:true,cloud:completed(),suspended:true},async a=>{
  await a.home();await a.click("Support");assert(a.text().includes("Trusted people"));await a.click("Community");const share=[...a.w.document.querySelectorAll("button")].find(button=>button.textContent==="Share");assert.equal(share.disabled,true);
}));
test("profile edits are sent to the public profile sync endpoint",()=>app({restored:true,cloud:completed()},async a=>{
  await a.home();await a.click("Profile");await a.click("Edit profile");await a.fill("Your name","Anne-Marie O’Neill");await a.click("Save changes");
  await until(()=>a.calls.some(call=>call.url.pathname.endsWith("/profiles")&&call.method==="POST"&&call.payload.display_name==="Anne-Marie O’Neill"));assert.equal(a.stored().name,"Anne-Marie O’Neill");
}));
test("support retries queued messages when an online event arrives",async()=>{
  const options={restored:true,cloud:completed(),supportFail:true};
  await app(options,async a=>{
    await a.home();await a.click("Support");await a.click("Request support");await a.fill("Your name","Test User");await a.fill("Email or phone","support@example.test");await a.click("Request support");
    await until(()=>a.stored().outbox.length===1);await sleep(100);options.supportFail=false;a.w.dispatchEvent(new a.w.Event("online"));await until(()=>a.stored().outbox.length===0);
  });
});
test("canceling support aborts the request without queueing it",async()=>{
  const options={restored:true,cloud:completed(),deferSupport:true};
  await app(options,async a=>{
    await a.home();await a.click("Support");await a.click("Request support");await a.fill("Your name","Test User");await a.fill("Email or phone","support@example.test");await a.click("Request support");await until(()=>options.resolveSupport);
    await a.click("Cancel");assert.equal(a.calls.find(call=>call.url.hostname==="formsubmit.co").signal.aborted,true);assert.equal(a.stored().outbox.length,0);
  });
});


test("a conflict pauses automatic saves until the user chooses a version",()=>app({restored:true,revision:2,cloud:completed(),local:{...completed(),_revision:1,_pendingSync:true,checks:[{day:"2026-01-01",mood:5,urge:2,note:"Keep this edit"}]}},async a=>{
  await a.home();await until(()=>a.text().includes("newer saved progress"));assert(!a.calls.some(call=>call.url.pathname.endsWith("/rpc/save_recovery_data")));
  await a.click("Review saved progress");await a.click("Keep this device's progress");await until(()=>a.stored()._pendingSync===false);assert.equal(a.stored().checks[0].note,"Keep this edit");assert.equal(a.stored()._revision,3);
}));
test("loading saved account data resolves a conflict only after explicit choice",()=>app({restored:true,revision:2,cloud:completed(),local:{...completed(),_revision:1,_pendingSync:true,checks:[{day:"2026-01-01",mood:5,urge:2,note:"Unsynced"}]}},async a=>{
  await a.home();await a.click("Review saved progress");await a.click("Load saved account progress");await until(()=>a.stored()._pendingSync===false);assert.equal(a.stored().checks.length,0);assert.equal(a.stored()._revision,2);
}));
test("publishing a local post creates a real server record",()=>app({restored:true,cloud:completed(),local:{...completed(),posts:[{id:"p100",t:"Imported journal",v:"me",mine:true,d:Date.now(),stage:"Starting out"}]}},async a=>{
  await a.home();await a.click("Community");await a.click("Make public");await until(()=>a.stored().posts.some(post=>post.id==="server-post"));
  assert(a.calls.some(call=>call.url.pathname.endsWith("/posts")&&call.method==="POST"&&call.payload.visibility==="community"));assert(!a.stored().posts.some(post=>post.id==="p100"));
}));
