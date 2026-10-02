FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY driver.mjs security.mjs ./
USER pwuser
ENV NODE_ENV=production
EXPOSE 8081
CMD ["node","driver.mjs"]
