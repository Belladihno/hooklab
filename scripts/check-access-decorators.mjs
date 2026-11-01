import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const HTTP_DECORATORS = new Set([
  'All',
  'Delete',
  'Get',
  'Head',
  'Options',
  'Patch',
  'Post',
  'Put',
]);
const ACCESS_DECORATORS = new Set(['Public', 'SignedIn']);
const root = join(process.cwd(), 'src');
const failures = [];

function decoratorName(decorator) {
  const expression = decorator.expression;
  const target = ts.isCallExpression(expression)
    ? expression.expression
    : expression;

  return ts.isIdentifier(target) ? target.text : undefined;
}

function hasDecorator(node, names) {
  return (
    ts.canHaveDecorators(node) &&
    (ts.getDecorators(node) ?? []).some((decorator) =>
      names.has(decoratorName(decorator)),
    )
  );
}

function inspectFile(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  function visit(node) {
    if (
      ts.isClassDeclaration(node) &&
      hasDecorator(node, new Set(['Controller']))
    ) {
      const classAccess = hasDecorator(node, ACCESS_DECORATORS);

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;

        const isRoute = hasDecorator(member, HTTP_DECORATORS);
        if (!isRoute) continue;

        if (!classAccess && !hasDecorator(member, ACCESS_DECORATORS)) {
          const position = source.getLineAndCharacterOfPosition(
            member.getStart(source),
          );
          failures.push(
            `${relative(process.cwd(), file)}:${position.line + 1} ${node.name?.text ?? 'class'}.${member.name.getText(source)}`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.ts') && !path.endsWith('.spec.ts'))
      inspectFile(path);
  }
}

walk(root);

if (failures.length > 0) {
  console.error('Routes missing @Public() or @SignedIn():');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Access declarations: ok');
