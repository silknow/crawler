import argparse
import csv
import os

parser = argparse.ArgumentParser()
parser.add_argument('-i', '--input', help="Input path of the missing urls CSV file")
parser.add_argument('-o', '--output', help="Output directory where the new CSV files will be stored")
parser.add_argument('-q', '--quiet', action='store_true', help="Do not print the list of missing files")
args = parser.parse_args()

with open(args.input) as csv_file:
  csv_reader = csv.reader(csv_file, delimiter=',')

  missing_urls_output = os.path.join(args.output, 'silknow-missing-urls.csv')
  missing_files_output = os.path.join(args.output, 'silknow-missing-files.csv')

  with open(missing_urls_output, mode='w') as missing_url:
    missing_url_writer = csv.writer(missing_url, delimiter=',', quotechar='"', quoting=csv.QUOTE_ALL)

    with open(missing_files_output, mode='w') as missing_file:
      missing_file_writer = csv.writer(missing_file, delimiter=',', quotechar='"', quoting=csv.QUOTE_ALL)
      header = next(csv_reader)
      missing_file_writer.writerow(header);

      filepath_cache = []

      for row in csv_reader:
        museum = row[3].split('/')[5]
        filename = os.path.basename(row[3])
        filepath = os.path.normpath(os.path.join(museum, filename))
        filepath_cache.append(filepath)

        if not os.path.exists(filepath):
          missing_file_writer.writerow(row)

          if not args.quiet:
            print(filepath + ' does not exist in files')

      for root, dirs, files in os.walk('./'):
        for file in files:
          if file.endswith('.jpg'):
            filepath = os.path.normpath(os.path.join(root, file))
            if filepath not in filepath_cache:
              missing_url_writer.writerow([filepath])

              if not args.quiet:
                print(filepath + ' does not exist in query result')
