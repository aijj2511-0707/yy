require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");

const app = express();


// =========================
// Firebase 설정
// =========================

const serviceAccount = {

  type: process.env.FIREBASE_TYPE,

  project_id: process.env.FIREBASE_PROJECT_ID,

  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,

  private_key:
  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),

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