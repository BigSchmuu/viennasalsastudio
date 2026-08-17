import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  // shadcn/ui components are vendored, not hand-maintained (see CLAUDE.md:
  // "NEVER create custom implementations of... shadcn/ui components") — they
  // get regenerated via `npx shadcn add`, so project lint rules don't apply.
  { ignores: ["src/components/ui/**"] },
  ...nextCoreWebVitals,
];

export default eslintConfig;
