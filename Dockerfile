FROM node:lts
RUN npm install -g vector-web-setup
RUN vector-web-setup configure
RUN vector-web-setup ota-sync
EXPOSE 8000
CMD vector-web-setup serve
