// Firebase config 与全局配置（已包含你的 Firebase 信息）
const firebaseConfig = {
  apiKey: "AIzaSyCqfE3hThLmbDWQE987ho7LrS7InLx_S8M",
  authDomain: "photoshareapp-15f24.firebaseapp.com",
  projectId: "photoshareapp-15f24",
  storageBucket: "photoshareapp-15f24.firebasestorage.app",
  messagingSenderId: "698614095306",
  appId: "1:698614095306:web:9d01ec9c4f03f6e9944333",
  measurementId: "G-QK9HBFPGC8"
};

// 管理员邮箱（已按照你的要求）
const ADMIN_EMAIL = "haochenxihehaohan@outlook.com";

// NFT.Storage token（推荐在部署时通过 GitHub Actions 注入到此文件）
// 例如在 CI/Actions 中使用 secrets.NFT_STORAGE_TOKEN 写入该文件。
// 如果你本地/手动测试，也可以直接把 token 填在下面（注意安全性）。
let NFT_STORAGE_TOKEN = ""; // <- 部署前请把 token 注入或赋值

// 保持原来接口名 getWeb3Token，以免修改其它代码（直接返回 nft.storage token）
function getWeb3Token(){
  return NFT_STORAGE_TOKEN;
}

// 初始化 firebase app（compat）
firebase.initializeApp(firebaseConfig);
firebase.analytics && firebase.analytics();

const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ ignoreUndefinedProperties: true });

window.APP_CONFIG = {
  auth, db, ADMIN_EMAIL,
  getWeb3Token // 返回 NFT.Storage token（保持兼容）
};