#!/usr/bin/env bash

source "${BASH_SOURCE%/*}/config.sh"
source "${BASH_SOURCE%/*}/lib.sh"

py_path="${BASH_SOURCE%/*}/check-silknow-urls.py"
out_filename="silknow-urls-missing.csv"
out_local_path="${BASH_SOURCE%/*}/${out_filename}"

if [[ ! "${py_path}" ]]; then
  echo "Python script check-silknow-urls.py not found"
  exit 1
fi

if [[ -z "${media_folder}" ]]; then
  echo "media_folder is undefined in config.sh"
  exit 1
fi

if [[ -z "${sparql_endpoint}" ]]; then
  echo "sparql_endpoint is undefined in config.sh"
  exit 1
fi

csv_filename="silknow-urls.csv"
csv_path="${BASH_SOURCE%/*}/${csv_filename}"
csv_destpath="${media_folder}/${csv_filename}"
py_filename="$(basename -- "${py_path}")"
py_destpath="${media_folder}/${py_filename}"
out_remote_path="${media_folder}/${out_filename}"
query_filename="imageURLs.sparql"
query_path="${BASH_SOURCE%/*}/${query_filename}"

curl -o "${csv_path}" -H "Accept: text/csv" --data-urlencode "query@${query_path}" "${sparql_endpoint}" || exit 1

if [[ ! -f "${csv_path}" ]]; then
  echo "${csv_path}: Not found"
  exit 1
fi

# Upload csv file and python script to media server
scp "${csv_path}" "${py_path}" "${media_user}"@silknow.uv.es:"${media_folder}" || exit 1

# Prevent timeout from media server
dotsleep 30

# # Execute python script on remote server to check for dead urls
cmd="cd '${media_folder}'; python check-silknow-urls.py -q -i '${csv_destpath}' -o '${out_filename}'"
ssh "${media_user}"@silknow.uv.es "${cmd}" || exit 1

# Prevent timeout from media server
dotsleep 30

# Download results from media server
scp "${media_user}"@silknow.uv.es:"${out_remote_path}" "${out_local_path}" || exit 1

count=$(($(wc -l "${out_filename}" | awk '{ print $1 }')-1))
echo "Found ${count} missing images (see file ${out_filename})"
