#!/usr/bin/env bash

SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
source "${SCRIPTPATH}/config.sh"
source "${SCRIPTPATH}/lib.sh"

filepath="${1}"

if [[ ! "${filepath}" ]]; then
  echo "Please enter a file path"
  exit 1
fi

oc_upload "${filepath}"