require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const axios = require("axios");
const app = express();


// =========================
// Firebase 설정
// =========================

const serviceAccount = {

  type: process.env.FIREBASE_TYPE,

  project_id: process.env.FIREBASE_PROJECT_ID,

  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,

  private_key:
(process.env.FIREBASE_PRIVATE_KEY || "")
.replace(/\\n/g,"\n"),

  client_email: process.env.FIREBASE_CLIENT_EMAIL,

  client_id: process.env.FIREBASE_CLIENT_ID,

  auth_uri:
  "https://accounts.google.com/o/oauth2/auth",

  token_uri:
  "https://oauth2.googleapis.com/token",

  auth_provider_x509_cert_url:
  "https://www.googleapis.com/oauth2/v1/certs",

  client_x509_cert_url:
  process.env.FIREBASE_CLIENT_CERT_URL

};


admin.initializeApp({

credential:
admin.credential.cert(serviceAccount)

});



const db = admin.firestore();




// =========================
// Cloudinary 설정
// =========================

cloudinary.config({

    cloud_name: process.env.CLOUDINARY_NAME,

    api_key: process.env.CLOUDINARY_KEY,

    api_secret: process.env.CLOUDINARY_SECRET

});




// =========================
// 이미지 업로드 설정
// =========================

const storage = new CloudinaryStorage({

    cloudinary,

    params: {

        folder:"reports",

        allowed_formats:[
            "jpg",
            "jpeg",
            "png",
            "webp"
        ]

    }

});



const upload = multer({

    storage,

    limits:{

        fileSize:
        5 * 1024 * 1024

    }

});




// =========================
// 기본 설정
// =========================

app.use(express.json());

app.use(
    express.urlencoded({
        extended:true
    })
);


app.use(express.static("public"));





// =========================
// 신고 등록
// =========================

app.post(
"/report",
upload.array("photos",10),
async(req,res)=>{


try{


const {
    building,
    location,
    content
}=req.body;



const files=req.files || [];



const imageUrls=[];



files.forEach(file=>{


    imageUrls.push({

        url:file.path,

        public_id:file.filename

    });


});




await db
.collection("reports")
.add({

    building,

    location,

    content,

    imageUrls,

    status:"접수전",

    time: admin.firestore.Timestamp.now()

});



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







// =========================
// 신고 목록
// =========================

app.get(
"/reports",
async(req,res)=>{


try{


const snapshot =
await db
.collection("reports")
.orderBy("time","desc")
.get();



const reports=[];



snapshot.forEach(doc=>{


reports.push({

    id:doc.id,

    ...doc.data()

});


});



res.json(reports);



}catch(e){


console.error(e);



res.status(500).json({

    ok:false,

    error:e.message

});


}



});








// =========================
// 상태 변경
// =========================

app.post(
"/status",
async(req,res)=>{


try{


const {
    id,
    status
}=req.body;



await db
.collection("reports")
.doc(id)
.update({

    status

});



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









// =========================
// 신고 삭제
// Firebase + Cloudinary
// =========================

app.delete(
"/report/:id",
async(req,res)=>{


try{


const id=req.params.id;



const docRef =
db
.collection("reports")
.doc(id);



const doc =
await docRef.get();



if(!doc.exists){


return res.status(404).json({

    ok:false,

    error:"신고 없음"

});


}



const report=doc.data();




// Cloudinary 이미지 삭제

if(report.imageUrls){


for(const image of report.imageUrls){


    if(image.public_id){


        await cloudinary
        .uploader
        .destroy(
            image.public_id
        );


    }


}


}




// Firestore 삭제

await docRef.delete();



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



// =========================
// 신고 엑셀 다운로드
// 여러 사진 + 압축 이미지 + 디자인
// =========================

app.get("/reports/excel", async (req,res)=>{

try{


const workbook = new ExcelJS.Workbook();

const sheet =
workbook.addWorksheet("불편신고");



// =========================
// 표 헤더 설정
// =========================

sheet.columns = [

{
header:"번호",
width:8
},

{
header:"사진",
width:25
},

{
header:"건물",
width:15
},

{
header:"위치",
width:15
},

{
header:"내용",
width:40
},

{
header:"상태",
width:15
},

{
header:"등록시간",
width:23
}

];



// =========================
// 제목 추가
// =========================

// 기존 헤더를 한 줄 아래로 이동
sheet.insertRow(1,[]);


sheet.mergeCells("A1:G1");


const titleCell =
sheet.getCell("A1");


titleCell.value =
"🏫 불편 신고 접수 현황";


titleCell.font={

bold:true,

size:18,

color:{
argb:"000000"
}

};


titleCell.fill={

type:"pattern",

pattern:"solid",

fgColor:{
argb:"FFFFFF"
}

};


titleCell.alignment={

horizontal:"center",

vertical:"middle"

};


sheet.getRow(1).height=35;




// =========================
// 헤더 스타일
// =========================

const header =
sheet.getRow(2);


header.height=25;


header.eachCell((cell)=>{


cell.fill={

type:"pattern",

pattern:"solid",

fgColor:{
argb:"1976D2"
}

};


cell.font={

bold:true,

color:{
argb:"FFFFFF"
}

};


cell.alignment={

horizontal:"center",

vertical:"middle"

};


});




const snapshot =
await db
.collection("reports")
.orderBy("time","desc")
.get();




let no=1;




for(const doc of snapshot.docs){


const r =
doc.data();



let time="";


if(r.time?.toDate){

time =
r.time
.toDate()
.toLocaleString("ko-KR");

}



const images =
r.imageUrls || [];




// =========================
// 사진 없는 신고
// =========================

if(images.length===0){



const row =
sheet.addRow([

no,

"",

r.building || "",

r.location || "",

r.content || "",

r.status || "",

time

]);



row.height=30;



row.eachCell((cell)=>{


cell.fill={

type:"pattern",

pattern:"solid",

fgColor:{
argb:"FFFFFF"
}

};


cell.alignment={

vertical:"middle",

wrapText:true

};


});



no++;


continue;


}









// =========================
// 사진 개수만큼 행 생성
// =========================


let first = true;

let startRow = null;
let endRow = null;


// 사진 개수만큼 행 생성

for(const img of images){


const row =
sheet.addRow([

first ? no : "",

"",

first ? r.building || "" : "",

first ? r.location || "" : "",

first ? r.content || "" : "",

first ? r.status || "" : "",

first ? time : ""

]);



// 병합용 행 번호 저장

if(startRow === null){

    startRow = row.number;

}

endRow = row.number;



row.height = 140;



row.eachCell((cell)=>{


cell.fill={

type:"pattern",

pattern:"solid",

fgColor:{
argb:"FFFFFF"
}

};


cell.alignment={

vertical:"middle",

horizontal:"center",

wrapText:true

};


});





try{


let imageUrl =
img.url;



imageUrl =
imageUrl.replace(

"/upload/",

"/upload/w_300,h_300,c_fill,q_auto,f_jpg/"

);



const response =
await axios.get(

imageUrl,

{

responseType:"arraybuffer"

}

);



const imageId =
workbook.addImage({

buffer:response.data,

extension:"jpeg"

});




sheet.addImage(

imageId,

{

tl:{

col:1.25,

row:row.number-1 + 0.1

},


ext:{

width:160,

height:160

}

}

);



}catch(e){


console.log(

"사진 삽입 실패:",

e.message

);


}



first=false;


}




// 여러 사진이면 셀 병합

if(images.length > 1){


sheet.mergeCells(
`A${startRow}:A${endRow}`
);


sheet.mergeCells(
`C${startRow}:C${endRow}`
);


sheet.mergeCells(
`D${startRow}:D${endRow}`
);


sheet.mergeCells(
`E${startRow}:E${endRow}`
);


sheet.mergeCells(
`F${startRow}:F${endRow}`
);


sheet.mergeCells(
`G${startRow}:G${endRow}`
);


}


no++;



}






// =========================
// 테두리
// =========================


sheet.eachRow((row)=>{


row.eachCell((cell)=>{


cell.border={


top:{
style:"thin",
color:{
argb:"DDDDDD"
}
},


bottom:{
style:"thin",
color:{
argb:"DDDDDD"
}
},


left:{
style:"thin",
color:{
argb:"DDDDDD"
}
},


right:{
style:"thin",
color:{
argb:"DDDDDD"
}
}


};



});



});







// =========================
// 출력 설정
// =========================


sheet.pageSetup={

orientation:"landscape",

fitToPage:true,

fitToWidth:1

};



sheet.views=[

{

state:"normal",

zoomScale:90

}

];






res.setHeader(

"Content-Type",

"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

);



res.setHeader(

"Content-Disposition",

'attachment; filename="reports.xlsx"'

);





await workbook.xlsx.write(res);


res.end();





}catch(e){


console.error(e);



res.status(500).json({

ok:false,

error:e.message

});


}



});


// =========================
// Multer 오류 처리
// =========================

app.use(
(err,req,res,next)=>{


console.error(err);



if(err.code==="LIMIT_FILE_SIZE"){


return res.status(400).json({

    ok:false,

    error:
    "사진은 5MB 이하만 가능합니다."

});


}



res.status(500).json({

    ok:false,

    error:err.message

});


}

);







// =========================
// 서버 실행
// =========================

const PORT =
process.env.PORT || 3000;



app.listen(
PORT,
()=>{

console.log(
`서버 실행: ${PORT}`
);

});