#!/usr/bin/env bash

SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

source "${SCRIPTPATH}/config.sh"
source "${SCRIPTPATH}/lib.sh"

py_path="${SCRIPTPATH}/check-silknow-urls.py"
out_local_path="${SCRIPTPATH}"

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
csv_path="${SCRIPTPATH}/${csv_filename}"
csv_destpath="${media_folder}/${csv_filename}"
py_filename="$(basename -- "${py_path}")"
py_destpath="${media_folder}/${py_filename}"
out_remote_path="${media_folder}"
query_filename="imageURLs.sparql"
query_path="${SCRIPTPATH}/${query_filename}"

curl -L -o "${csv_path}" -H "Accept: text/csv" --data-urlencode "query@${query_path}" "${sparql_endpoint}" || exit 1

if [[ ! -f "${csv_path}" ]]; then
  echo "${csv_path}: Not found"
  exit 1
fi

# Upload csv file and python script to media server
scp "${csv_path}" "${py_path}" "${media_user}"@silknow.uv.es:"${media_folder}" || exit 1

# Prevent timeout from media server
dotsleep 30

# # Execute python script on remote server to check for dead urls
cmd="cd '${media_folder}'; python check-silknow-urls.py -q -i '${csv_destpath}' -o '${out_remote_path}'"
ssh "${media_user}"@silknow.uv.es "${cmd}" || exit 1

# Prevent timeout from media server
dotsleep 30

# Download results from media server
scp "${media_user}"@silknow.uv.es:"${out_remote_path}/silknow-missing-urls.csv" "${out_local_path}/silknow-missing-urls.csv" || exit 1
scp "${media_user}"@silknow.uv.es:"${out_remote_path}/silknow-missing-files.csv" "${out_local_path}/silknow-missing-files.csv" || exit 1

count_urls=$(($(wc -l "${out_local_path}/silknow-missing-urls.csv" | awk '{ print $1 }')-1))
count_files=$(($(wc -l "${out_local_path}/silknow-missing-files.csv" | awk '{ print $1 }')-1))
echo "Found ${count_urls} missing images urls (see file ${out_local_path}/silknow-missing-urls.csv})"
echo "Found ${count_files} missing images urls (see file ${out_local_path}/silknow-missing-files.csv})"
