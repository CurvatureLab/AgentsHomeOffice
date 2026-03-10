FROM nikolaik/python-nodejs:python3.10-nodejs20

WORKDIR /app
COPY . .

RUN pip install -r backend/requirements.txt
RUN npm install ws http-proxy-middleware express cors

ENV DOCKER_ENV=1
EXPOSE 8080

CMD ["sh", "./start.sh"]
