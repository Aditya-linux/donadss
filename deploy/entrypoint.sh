#!/bin/sh
set -eu

mkdir -p /app/data
chown donads:donads /app/data

exec gosu donads /usr/local/bin/donads-dispatch
