# OMEGA - copia en la nube (espejo de la PC del gimnasio)
FROM node:22.23.4-slim
WORKDIR /app
COPY package.json server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN rm -f src/demo-data.js
ENV OMEGA_NODO=nube PORT=10000 DATA_DIR=/tmp/omega-datos BACKUP_DIR=/tmp/omega-copias
EXPOSE 10000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
