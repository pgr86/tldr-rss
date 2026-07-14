FROM node:18 as Builder

WORKDIR /action

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn run build

FROM node:18-slim

WORKDIR /action

COPY --from=Builder /action/dist /action
COPY --from=Builder /action/docker-entrypoint.sh /action/docker-entrypoint.sh

ENTRYPOINT ["/action/docker-entrypoint.sh"]
