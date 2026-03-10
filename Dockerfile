FROM nikolaik/python-nodejs:python3.10-nodejs20

WORKDIR /app
COPY . .

RUN pip install -r backend/requirements.txt websockets
RUN npm install ws http-proxy-middleware express cors

EXPOSE 19000

CMD ["sh", "./start.sh"]
