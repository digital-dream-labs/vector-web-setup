FROM node:lts
RUN npm install -g digital-dream-labs/vector-web-setup
RUN vector-web-setup configure
RUN vector-web-setup ota-sync
ENV PORT 8000
EXPOSE 8000
CMD vector-web-setup serve -p $PORT
