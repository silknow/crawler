import argparse
import csv
from os import path

parser = argparse.ArgumentParser()
parser.add_argument('-i', '--input', help="Input path of the missing urls CSV file")
parser.add_argument('-o', '--output', help="Output path where the new CSV file will be stored")
parser.add_argument('-q', '--quiet', action='store_true', help="Do not print the list of missing files")
args = parser.parse_args()

with open(args.input) as csv_file:
  csv_reader = csv.reader(csv_file, delimiter=',')

  with open(args.output, mode='w') as missing_file:
    missing_writer = csv.writer(missing_file, delimiter=',', quotechar='"', quoting=csv.QUOTE_ALL)
    header = next(csv_reader)
    missing_writer.writerow(header);

    for row in csv_reader:
      museum = row[3].split('/')[5]
      filename = path.basename(row[3])
      filepath = path.join(museum, filename)

      if not path.exists(filepath):
        missing_writer.writerow(row)

        if not args.quiet:
          print(filepath + ' does not exist')