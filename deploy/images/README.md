# Infra images

The Pi's nginx, Redis, aria2 and MySQL as containers, each one Ubuntu noble's own package in an
`ubuntu:24.04` image: the same versions the Pi ran from apt, with the same Ubuntu security fixes.
Built for arm64 by `.github/workflows/infra-images.yml` and published as
`ghcr.io/mr-bhavya/dbworld-<service>:<yyyymmdd>-<hash>`, where the hash covers the image's package
list and its Dockerfile, so a new tag appears only when something in the image changed.

No configuration is baked in. Each container mounts the host's own config and data at the same
paths (`/etc/nginx`, `/etc/redis`, `/etc/mysql`, `/app/db_world/conf/aria2`, …); see `compose.yml`
and `DOCKER.md` in db-world-config. The Pi deploys them with `dbworld-compose`, and updates nginx,
Redis and aria2 weekly by itself (`dbworld-images-update.timer`). MySQL is only ever deployed by hand.

Every image lists its packages in `/usr/share/dbworld-image/packages.txt`.
