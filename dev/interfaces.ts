export type JwkExtAG = JsonWebKey & { initv?: string };

export interface Encryptor extends EventTarget {
  key?: CryptoKey;
  encrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer>,
  decrypt(data: ArrayBuffer, authData?: ArrayBuffer): Promise<ArrayBuffer>,
  generateJWK(): Promise<Array<JwkExtAG>>,
  readJWK(jwk: JwkExtAG): Promise<void>,
  ready(): boolean,
  dropKeys(): void,
}

export interface VisualElement {
  classList: Array<string>;
  children: Array<VisualElement>;
  element: Element;

  s(...childElements: Array<VisualElement> | Array<string>): VisualElement;
  render(): Element;
}