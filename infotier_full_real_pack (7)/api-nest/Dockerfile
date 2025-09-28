FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate || true
COPY tsconfig.json nest-cli.json ./
COPY src ./src
EXPOSE 3000
CMD ["npx","nest","start"]
