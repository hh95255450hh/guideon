const puppeteer=require('puppeteer');
(async()=>{
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  const p=await b.newPage();
  await p.setViewport({width:1280,height:850});
  await p.goto('https://guideon.om/',{waitUntil:'networkidle2',timeout:40000});
  await new Promise(r=>setTimeout(r,3500));
  await p.screenshot({path:'shot_new.png'});
  await b.close();
  console.log('OK');
})().catch(e=>console.log('ERR',e.message));
