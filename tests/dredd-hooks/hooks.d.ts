declare module "hooks" {
  function beforeEach(callback: (transaction: any, done: any) => void): void;
  export { beforeEach };
  function before(transactionName: string, callback: (transaction:any, done: any) => void): void;
  export {before};
}