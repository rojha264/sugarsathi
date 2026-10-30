/** Ids in routes ("/remote/8f2c…") would make every screen unique, so they become ":id". */
export const screenName = (path: string) =>
  path
    .split('/')
    .map((p) => (/\d/.test(p) && p.length > 8 ? ':id' : p))
    .join('/') || '/';
