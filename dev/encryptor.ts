import type * as interfaces from './interfaces';

export class AesGcmEncryptor extends EventTarget {
  public algorithm = 'AES-GCM';
  public keyLength = 256;
  
  public key?: CryptoKey;
  private iv?: Uint8Array;
  
  public async encrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.encrypt(
      { name: this.algorithm, iv: this.iv, additionalData: authData },
      this.key as CryptoKey,
      data,
    );
  }
  
  public async decrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.decrypt(
      { name: this.algorithm, iv: this.iv, additionalData: authData },
      this.key as CryptoKey,
      data,
    );
  }
  
  public ready(): boolean {
    return !(!this.key || !this.iv);
  }
  
  public async generateJWK(): Promise<Array<interfaces.JwkExtAG>> {
    const key = await window.crypto.subtle.generateKey(
      { name: this.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt'],
    )
    const iv: Uint8Array = window.crypto.getRandomValues(new Uint8Array(12));
    const jwk: interfaces.JwkExtAG = await window.crypto.subtle.exportKey('jwk', key);
    jwk.initv = this.base64iv(iv);
    return [jwk];
  }
  
  public async readJWK(jwk: interfaces.JwkExtAG) {
    if (!jwk.initv) throw new TypeError('There is no valid initialization vector in key file')
    this.iv = this.ivFromB64(jwk.initv);
    this.key = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: this.algorithm },
      true,
      ['encrypt', 'decrypt'],
    );
    this.dispatchEvent(new Event('change'));
  }
  
  private base64iv(iv: Uint8Array): string {
    let bString = '';
    for (let i = 0; i < iv.length; i++) {
      bString += String.fromCharCode(iv[i]);
    }
    return window.btoa(bString);
  }
  
  private ivFromB64(b64: string): Uint8Array {
    const bString = window.atob(b64);
    const iv = new Uint8Array(12);
    for (let i = 0; i < bString.length; i++) {
      iv[i] = bString.charCodeAt(i);
    }
    return iv;
  }
  
  public dropKeys() {
    this.key = undefined;
    this.iv = undefined;
    this.dispatchEvent(new Event('change'));
  }
}