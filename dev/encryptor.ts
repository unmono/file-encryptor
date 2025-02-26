import type * as interfaces from './interfaces';
import { UserError } from "./exceptions.ts";

export class AesGcmEncryptor extends EventTarget implements interfaces.Encryptor {
  static algorithm = 'AES-GCM';
  public keyLength = 256;
  
  public key?: CryptoKey;
  private iv?: Uint8Array;
  
  public async encrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.encrypt(
      { name: AesGcmEncryptor.algorithm, iv: this.iv, additionalData: authData },
      this.key as CryptoKey,
      data,
    );
  }
  
  public async decrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.decrypt(
      { name: AesGcmEncryptor.algorithm, iv: this.iv, additionalData: authData },
      this.key as CryptoKey,
      data,
    );
  }
  
  public ready(): boolean {
    return !(!this.key || !this.iv);
  }
  
  public async generateJWK(): Promise<Array<interfaces.NamedJWK>> {
    const key = await window.crypto.subtle.generateKey(
      { name: AesGcmEncryptor.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt'],
    )
    const iv: Uint8Array = window.crypto.getRandomValues(new Uint8Array(12));
    const jwk: interfaces.JwkExtAG = await window.crypto.subtle.exportKey('jwk', key);
    jwk.initv = this.base64iv(iv);
    return [{ name: 'symmetric', key: jwk }];
  }
  
  public async readJWK(jwk: interfaces.JwkExtAG) {
    if (!jwk.initv) throw new TypeError('There is no valid initialization vector in key file')
    this.iv = this.ivFromB64(jwk.initv);
    this.key = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: AesGcmEncryptor.algorithm },
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

export class RSAEncryptor extends EventTarget implements interfaces.Encryptor {
  static algorithm = 'RSA-OAEP';
  private rsaParams = {
    name: RSAEncryptor.algorithm,
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-256',
  };
  public key?: CryptoKey;
  
  public async encrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (authData) console.warn('Authentication data is omitted in RSA algorithm.')
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.encrypt(
      { name: RSAEncryptor.algorithm },
      this.key as CryptoKey,
      data,
    );
  }
  
  public async decrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.ready()) throw new Error('Encryptor is not initialized');  // TODO
    return await window.crypto.subtle.decrypt(
      { name: RSAEncryptor.algorithm },
      this.key as CryptoKey,
      data,
    );
  }
  
  public ready(): boolean {
    return !!this.key;
  }
  
  public dropKeys() {
    this.key = undefined;
    this.dispatchEvent(new Event('change'));
  }
  
  public async readJWK(jwk: interfaces.JwkExtAG) {
    if (
      !jwk.key_ops
      ||
      jwk.key_ops.length != 1
      ||
      !['encrypt', 'decrypt'].includes(jwk.key_ops[0])
    ) throw new UserError('Wrong key');  // TODO
    this.key = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      this.rsaParams,
      true,
      jwk.key_ops as KeyUsage[],
    )
    this.dispatchEvent(new Event('change'));
  }
  
  public async generateJWK(): Promise<Array<interfaces.NamedJWK>> {
    const keyPair = await window.crypto.subtle.generateKey(
      this.rsaParams,
      true,
      ['encrypt', 'decrypt'],
    )
    const publicKey = await window.crypto.subtle.exportKey('jwk', (keyPair as CryptoKeyPair).publicKey);
    const privateKey = await window.crypto.subtle.exportKey('jwk', (keyPair as CryptoKeyPair).privateKey);
    const publicNamedKey = { name: 'public', key: publicKey };
    const privateNamedKey = { name: 'private', key: privateKey };
    return [publicNamedKey, privateNamedKey];
  }
}
