FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Installation des dépendances en premier pour profiter du cache Docker
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

# On ne lance pas l'application en root
USER node
EXPOSE 3000

CMD ["node", "src/app.js"]
