import CryptoJS from "crypto-js";

const KEY = CryptoJS.enc.Utf8.parse("2120131404240929");
const IV = CryptoJS.enc.Utf8.parse("2120131404240929");

/**
 * AES-CBC 加密，与 dashboard `src/util/index.ts` 和后端 `helper.encodeUser` 对齐。
 * 用于登录时加密 { username, password }。
 */
export function encrypt(data: any): string {
  if (typeof data === "object") {
    try {
      data = JSON.stringify(data);
    } catch (e) {
      console.log("encrypt error:", e);
    }
  }
  const dataHex = CryptoJS.enc.Utf8.parse(data);
  const encrypted = CryptoJS.AES.encrypt(dataHex, KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.ciphertext.toString();
}
