FROM node:20-alpine AS build

ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

ARG VITE_CAPTCHA_ENABLED=true
ENV VITE_CAPTCHA_ENABLED=$VITE_CAPTCHA_ENABLED

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
