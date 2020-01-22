#!/usr/bin/env bash

source "${BASH_SOURCE%/*}/config.sh"
source "${BASH_SOURCE%/*}/lib.sh"

filepath="${1}"

if [[ ! "${filepath}" ]]; then
  echo "Please enter a file path"
  exit 1
fi

oc_upload "${filepath}"