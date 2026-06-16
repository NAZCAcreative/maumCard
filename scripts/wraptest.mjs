import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
const W=1024,H=1536;
const data = fs.readFileSync("public/fonts/NanumGothic-Regular.ttf");
// 우측 40% 영역(좁은 박스)에 절대배치 + 긴 텍스트 → 줄바꿈 되나?
const regionX0=0.56, regionY0=0.1, regionW=0.40, regionH=0.45;
const boxW = Math.round(regionW*W), boxH=Math.round(regionH*H);
const tree = { type:"div", props:{ style:{width:W,height:H,display:"flex",position:"relative",fontFamily:"f"}, children:[
  // 영역 시각화(빨강 테두리)
  { type:"div", props:{ style:{position:"absolute",left:Math.round(regionX0*W),top:Math.round(regionY0*H),width:boxW,height:boxH,border:"4px solid red",display:"flex"} } },
  // 텍스트 컨테이너 (영역에 절대배치)
  { type:"div", props:{ style:{position:"absolute",left:Math.round(regionX0*W),top:Math.round(regionY0*H),width:boxW,height:boxH,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px"}, children:[
    { type:"div", props:{ style:{width:boxW-40,fontSize:44,color:"#1e3a5f",lineHeight:1.5,textAlign:"center",whiteSpace:"pre-wrap",wordBreak:"keep-all"}, children:"늘 곁에서 응원할게요. 오늘도 충분히 잘하고 있어요. 사랑을 담아 마음을 전합니다." } },
  ] } },
]}};
const svg = await satori(tree,{width:W,height:H,fonts:[{name:"f",data,weight:400,style:"normal"}]});
fs.writeFileSync("/tmp/wraptest.png", new Resvg(svg,{font:{loadSystemFonts:false}}).render().asPng());
console.log("ok");
