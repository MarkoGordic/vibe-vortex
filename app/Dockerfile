FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/src/public/uploads

ENV NODE_ENV=production
EXPOSE 1337

CMD ["node", "src/server.js"]
