#!/usr/bin/env bash

npm install .

echo "NODE_CLIENT_PATH=\"\`dirname \\\"\$0\\\"\`\"; node \$NODE_CLIENT_PATH/src/vec-cli.js $@\$@" > vec-cli
chmod +x vec-cli

# src files to copy
RTS_FILES=(bleMessageProtocol.js clad.js messageExternalComms.js rtsCliUtil.js \
  rtsV2Handler.js rtsV3Handler.js rtsV4Handler.js rtsV5Handler.js rtsV6Handler.js)

mkdir -p generated

for i in "${RTS_FILES[@]}"
do
  cp ../rts-js/$i generated/$i
done

cp -R ../src-node-client/. generated/
