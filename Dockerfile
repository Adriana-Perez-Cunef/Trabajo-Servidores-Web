# Imagen basada en Debian (glibc): bcrypt trae binarios precompilados para ella (en Alpine/musl pueden dar problemas)
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Instalar solo dependencias de producción (aprovecha la caché de capas)
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY docs ./docs

# Ejecutar sin privilegios de root (el usuario 'node' ya existe en la imagen)
USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
