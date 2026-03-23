const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

async function upload(){

const data = new FormData();

data.append("file", fs.createReadStream("./video.mp4"));

const res = await axios.post(
"https://api.pinata.cloud/pinning/pinFileToIPFS",
data,
{
headers:{
"Content-Type": `multipart/form-data; boundary=${data._boundary}`,
pinata_api_key:"YOUR_API_KEY",
pinata_secret_api_key:"YOUR_SECRET_KEY"
}
}
);

console.log("IPFS Hash:",res.data.IpfsHash);

}

upload();