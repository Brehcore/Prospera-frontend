# Estágio 1: Build do Angular
FROM node:22-alpine AS build

WORKDIR /app

# Copia e instala dependências
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copia o código e faz o build
COPY . .
RUN npm run build -- --configuration production

# Estágio 2: Servidor Nginx
FROM nginx:alpine

# Limpa a pasta padrão do Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copia o resultado do build
COPY --from=build /app/dist /tmp/dist
RUN if [ -d "/tmp/dist/browser" ]; then \
      cp -r /tmp/dist/browser/* /usr/share/nginx/html/; \
    elif [ -d "/tmp/dist/frontend" ]; then \
      cp -r /tmp/dist/frontend/browser/* /usr/share/nginx/html/ 2>/dev/null || cp -r /tmp/dist/frontend/* /usr/share/nginx/html/; \
    else \
      cp -r /tmp/dist/*/* /usr/share/nginx/html/ 2>/dev/null || cp -r /tmp/dist/* /usr/share/nginx/html/; \
    fi

# Copia a configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80