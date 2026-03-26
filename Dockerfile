FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ .
COPY --from=client-build /app/client/dist ./client-dist
ENV CLIENT_DIST_PATH=/app/client-dist
EXPOSE 3000
CMD ["node", "server.js"]
