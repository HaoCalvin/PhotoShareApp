// 替换或插入：使用 nft.storage 上传文件（保持原函数名 uploadFileToWeb3 以兼容现有调用）
async function uploadFileToWeb3(file){
  const token = getWeb3Token();
  if(!token) throw new Error('未配置 NFT.Storage token，请在 js/firebase-config.js 中设置并注入 NFT_STORAGE_TOKEN');
  const url = 'https://api.nft.storage/upload';
  const fd = new FormData();
  fd.append('file', file, file.name);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: fd
  });

  if(!res.ok){
    const txt = await res.text();
    throw new Error('上传失败: ' + txt);
  }

  const rjson = await res.json();
  // nft.storage 返回的数据在 rjson.value.cid
  const cid = rjson && rjson.value && rjson.value.cid;
  if(!cid) throw new Error('上传成功但未获取 CID');

  // 使用公共网关访问：{cid}.ipfs.dweb.link 或 nftstorage.link
  const gatewayUrl = `https://${cid}.ipfs.dweb.link/${encodeURIComponent(file.name)}`;

  return {
    cid,
    name: file.name,
    url: gatewayUrl
  };
}