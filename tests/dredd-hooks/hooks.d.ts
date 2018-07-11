declare module "hooks" {
  function beforeEach(callback: (transaction: any, done: any) => void): void;
  export { beforeEach };
}