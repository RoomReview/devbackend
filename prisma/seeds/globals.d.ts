declare module 'path' {
  const path: typeof import('node:path');
  export default path;
}

declare module 'url' {
  const url: typeof import('node:url');
  export default url;
}

declare module 'util' {
  const util: typeof import('node:util');
  export default util;
}

declare const process: typeof import('node:process');
