# silknow_upload_dumps

## Getting started

Make a copy of `config.sh.example` and name it `config.sh`, then edit the file to add your ownCloud account (email and password).

### Upload records

```bash
./upload_records.sh "path to records .tar.gz archive"
```

### Upload images

```bash
./upload_images.sh [-q|--quiet] "path to files .tar.gz archive" "museum identifier"
```

A list of museum identifiers can be found [here](https://github.com/silknow/crawler/#list-of-museums).

Parameters:

* `-q|--quiet`. Optional. By default, the script will prompt you if you want to upload the file to ownCloud and/or to the media server. When passing `-q` (or `--quiet`) it will upload to both without prompting you.

### Get a list of missing images on the media server

```bash
./list_missing_images.sh
```

The script will fetch all image URLs from the configured SPARQL endpoint, then upload them as a CSV file along with `check-silknow-urls.py` to the media server, and finally it will execute the python script to compute a diff of the files available on the media server with those from the CSV sheet. The result will be stored in a new CSV file (`silknow-urls-missing.csv`) which only contains rows with missing images.

## Configuration variables

| Variable | Description | Default value |
| -------- | ----------- | ------------- |
| oc_user | ownCloud account name or email address. | |
| oc_pass | ownCloud account password. | |
| media_user | Media server user. | upload |
| media_folder | Media server upload path. | /usr/share/tomcat/webapps/silknow/media |
| sparql_endpoint | SPARQL server address, used for fetching the list of image URLs. | http://data.silknow.org/sparql |