#!/bin/bash
# sets up the graphite docker image for testing

docker stop graphite
docker rm graphite

docker pull juttler/graphite:1
docker run -d --name graphite -p 8080:80 -p 2003:2003 -v `pwd`/storage-schemas.conf:/opt/graphite/conf/storage-schemas.conf juttler/graphite:1

