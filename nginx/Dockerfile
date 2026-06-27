FROM node:20-alpine AS build

ARG VITE_TURNSTILE_SITE_KEY
<<<<<<< HEAD
=======
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
