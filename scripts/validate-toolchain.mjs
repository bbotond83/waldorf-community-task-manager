const REQUIRED_NODE_MAJOR = 24;
const REQUIRED_NPM_MAJOR = 11;

const nodeMajor = Number(process.versions.node.split(".")[0]);
const npmVersionMatch = process.env.npm_config_user_agent?.match(/npm\/(\d+)\./);
const npmMajor = npmVersionMatch ? Number(npmVersionMatch[1]) : undefined;

if (nodeMajor !== REQUIRED_NODE_MAJOR) {
  console.error(`TOOLCHAIN_NODE_UNSUPPORTED: required Node ${REQUIRED_NODE_MAJOR}.x`);
  process.exit(1);
}

if (npmMajor !== REQUIRED_NPM_MAJOR) {
  console.error(`TOOLCHAIN_NPM_UNSUPPORTED: required npm ${REQUIRED_NPM_MAJOR}.x`);
  process.exit(1);
}

console.log(`TOOLCHAIN_VALID: Node ${REQUIRED_NODE_MAJOR}.x / npm ${REQUIRED_NPM_MAJOR}.x`);
