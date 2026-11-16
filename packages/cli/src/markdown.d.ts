/** Markdown files are bundled as plain strings (tsup `--loader .md=text`). */
declare module "*.md" {
  const content: string;
  export default content;
}
