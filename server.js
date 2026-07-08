require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();


/* =========================
   Cloudinary 설정
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});



/* =========================
   이미지 저장 설정
========================= */

const storage = new CloudinaryStorage({

  cloudinary,

  params: {

    folder: "reports",

    allowed_formats: [
      "jpg",
      "jpeg",
      "png",
      "webp"
    ]

  }

});



/* =========================
   Multer 설정
========================= */

const upload = multer({

  storage,

  limits:{
    fileSize:5 * 1024 * 1024
  }

});



/* =========================
   기본 설정
========================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended:true
  })
);


app.use(express.static("public"));



/* =========================
   데이터 파일
========================= */

if(!fs.existsSync("data")){

  fs.mkdirSync("data");

}


const DB_FILE="./data/reports.json";



if(!fs.existsSync(DB_FILE)){

  fs.writeFileSync(
    DB_FILE,
    "[]"
  );

}



/* =========================
   데이터 함수
========================= */


function getReports(){

  return JSON.parse(
    fs.readFileSync(DB_FILE)
  );

}



function saveReports(data){

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data,null,2)
  );

}





/* =========================
   신고 등록
========================= */


app.post(
"/report",
upload.array("photos",10),
(req,res)=>{


try{


const {
  building,
  location,
  content
}=req.body;



const files=req.files || [];



const reports=getReports();



const imageUrls=[];



files.forEach(file=>{


  imageUrls.push({

    url:file.path,

    public_id:file.filename

  });


});




const newReport={


  id:Date.now(),

  building,

  location,

  content,


  imageUrls,


  status:"접수전",


  time:
  new Date()
  .toISOString()
  .slice(0,16)
  .replace("T"," ")


};



reports.push(newReport);



saveReports(reports);



res.json({

 ok:true

});



}catch(e){


console.error(e);



res.status(500).json({

 ok:false,

 error:e.message

});


}


});







/* =========================
   신고 목록
========================= */


app.get(
"/reports",
(req,res)=>{


try{


const reports=getReports();


res.json(
 reports.reverse()
);



}catch(e){


res.status(500).json({

 ok:false,

 error:e.message

});


}



});








/* =========================
   상태 변경
========================= */


app.post(
"/status",
(req,res)=>{


try{


const {
 id,
 status
}=req.body;



const reports=getReports();



const updated=
reports.map(r=>

r.id==id

?
{
 ...r,
 status
}

:

r

);



saveReports(updated);



res.json({

ok:true

});



}catch(e){


res.status(500).json({

ok:false,

error:e.message

});


}



});








/* =========================
   신고 삭제
   + Cloudinary 이미지 삭제
========================= */


app.delete(
"/report/:id",
async(req,res)=>{


try{


const id=
Number(
req.params.id
);



const reports=getReports();



const target=
reports.find(
r=>r.id===id
);



if(target && target.imageUrls){


for(const image of target.imageUrls){


try{


await cloudinary.uploader.destroy(
 image.public_id
);


}catch(err){


console.error(
"Cloudinary 삭제 실패:",
err
);


}


}


}





const filtered=
reports.filter(
r=>r.id!==id
);



saveReports(filtered);



res.json({

ok:true

});



}catch(e){


console.error(e);



res.status(500).json({

ok:false,

error:e.message

});


}


});









/* =========================
   업로드 오류 처리
========================= */


app.use(
(err,req,res,next)=>{


console.error(err);



if(err.code==="LIMIT_FILE_SIZE"){


return res.status(400).json({

ok:false,

error:"사진은 5MB 이하만 업로드 가능합니다."

});


}



res.status(500).json({

ok:false,

error:err.message

});


}

);








/* =========================
   서버 실행
========================= */


const PORT=
process.env.PORT || 3000;



app.listen(
PORT,
()=>{

console.log(
`서버 실행: ${PORT}`
);

});